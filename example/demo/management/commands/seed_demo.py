"""Seed the example site with a synthetic podcast (episodes, audio, chapters, transcripts, galleries)."""

import datetime as dt
import json
import random
import subprocess
import tempfile
from io import BytesIO
from pathlib import Path
from uuid import uuid4

from cast.media_derivation import save_transcript_with_derivations
from cast.models import (
    Audio,
    ChapterMark,
    Contributor,
    Episode,
    EpisodeContributor,
    Gallery,
    Podcast,
    Post,
    PostCategory,
    Transcript,
)
from cast.models.theme import TemplateBaseDirectory
from cast.post_media import prepare_post_media
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone
from django_comments import get_model as get_comment_model
from PIL import Image as PILImage
from PIL import ImageDraw
from wagtail.images.models import Image
from wagtail.models import Site

PODCAST_SLUG = "ground-loop"
AUDIO_SECONDS = 540

HOSTS = ["Mara Lindqvist", "Tobias Arendt"]
GUESTS = ["Ines Okafor", "Paul Brandt", "Yuki Tanabe", "Selma Hartwig"]

EPISODES = [
    (
        "Why your feed reader still matters",
        "Open feeds, twenty years on, and why we keep coming back.",
        "web",
        ["rss", "open-web"],
    ),
    (
        "Recording in a room that fights back",
        "Blankets, bookshelves and the cheapest fixes for a boomy room.",
        "audio",
        ["recording", "acoustics"],
    ),
    (
        "SQLite in production, honestly",
        "Where a single file is enough, and the day it stopped being enough.",
        "backend",
        ["sqlite", "databases"],
    ),
    (
        "The loudness war never ended",
        "LUFS targets, podcast apps and what listeners actually hear.",
        "audio",
        ["mastering", "loudness"],
    ),
    (
        "Static sites with a pulse",
        "Server-rendered pages, a little JavaScript, and knowing when to stop.",
        "web",
        ["frontend", "performance"],
    ),
    (
        "Transcripts are an interface",
        "Search, quotes and accessibility: what a good transcript makes possible.",
        "accessibility",
        ["transcripts", "search"],
    ),
    (
        "Migrations at three in the morning",
        "Stories from schema changes that went fine, and one that did not.",
        "backend",
        ["databases", "operations"],
    ),
    (
        "Chapter marks, the underrated feature",
        "How we cut an episode so you can skip the part about cables.",
        "audio",
        ["chapters", "editing"],
    ),
    (
        "Dark mode is a contrast problem",
        "Designing two themes without doubling the work.",
        "accessibility",
        ["design", "color"],
    ),
    (
        "Self-hosting a podcast for a decade",
        "Storage, feeds, statistics, and the bill at the end of the year.",
        "web",
        ["hosting", "open-web"],
    ),
    (
        "Queues, tasks and patience",
        "Background work without a zoo of moving parts.",
        "backend",
        ["tasks", "operations"],
    ),
    (
        "Microphones we stopped recommending",
        "Gear advice ages badly. We go through ours.",
        "audio",
        ["recording", "gear"],
    ),
]

CHAPTER_TITLES = [
    "Hello and housekeeping",
    "What changed since last time",
    "The main story",
    "A detour worth taking",
    "Listener mail",
    "Picks of the week",
]

SENTENCES = [
    "I went back and measured it, and the number was not what I had been telling people for years.",
    "The boring answer is usually the right one, but it helps to know why it is boring.",
    "We tried the clever version first, obviously, and then spent a weekend taking it out again.",
    "What surprised me is how little of this is about tools and how much is about habits.",
    "If you only change one thing after this episode, change that.",
    "There is a version of this that works for a team of two and falls apart at twenty.",
    "I keep a text file for exactly this, and it has saved me more often than any dashboard.",
    "Nobody notices when it works, which is the whole point.",
    "The first time it failed we blamed the network. It was not the network.",
    "You can hear the difference on headphones, and almost nobody else will, and that is fine.",
    "We should say clearly that this is our setup and not a recommendation for everyone.",
    "It took me embarrassingly long to read the manual, and the answer was on page two.",
    "The part I like is that you can explain it to someone in a single sentence.",
    "A listener wrote in about this, and their approach is better than ours.",
    "I would rather have one thing I understand than three things that are faster.",
    "That is a trade-off, not a mistake, and I would make it again.",
    "Let me read the exact wording, because the details matter here.",
    "So the short version: start small, write it down, and measure before you change anything.",
]

COMMENTS = [
    ("Jonas", "Great episode. The part about measuring first changed how I set up my own recordings."),
    ("Priya", "I disagree a little on the second chapter, but the listener mail section made up for it."),
    ("Henrik", "Could you link the text file template you mentioned?"),
]

POSTS = [
    ("Studio notes: the new desk", "We rebuilt the recording corner. A few pictures before it gets messy again."),
    ("Meetup recap in pictures", "Thank you to everyone who came by. Here is what the evening looked like."),
]

PALETTES = [
    ((38, 70, 120), (214, 166, 60)),
    ((24, 96, 98), (232, 221, 196)),
    ((92, 52, 110), (240, 190, 140)),
    ((30, 40, 60), (120, 170, 220)),
    ((140, 70, 50), (236, 226, 210)),
    ((40, 90, 60), (220, 210, 120)),
]


def clock(seconds: float) -> str:
    whole = int(seconds)
    millis = int(round((seconds - whole) * 1000))
    return f"{whole // 3600:02d}:{whole % 3600 // 60:02d}:{whole % 60:02d}.{millis:03d}"


def make_picture(index: int, size: tuple[int, int] = (1600, 1067)) -> ContentFile:
    """Draw a simple abstract picture so galleries and covers have real pixels."""
    base, accent = PALETTES[index % len(PALETTES)]
    rng = random.Random(index)
    image = PILImage.new("RGB", size, base)
    draw = ImageDraw.Draw(image)
    width, height = size
    for step in range(9):
        mix = step / 9
        color = tuple(int(base[c] + (accent[c] - base[c]) * mix) for c in range(3))
        radius = int(height * (0.9 - step * 0.09))
        cx = int(width * (0.3 + 0.4 * rng.random()))
        cy = int(height * (0.35 + 0.3 * rng.random()))
        draw.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), fill=color)
    buffer = BytesIO()
    image.save(buffer, format="JPEG", quality=82)
    return ContentFile(buffer.getvalue(), name=f"demo-{index}.jpg")


def render_audio(directory: Path) -> dict[str, bytes]:
    """Render one quiet synthetic recording with ffmpeg and return it as m4a and mp3."""
    source = f"anoisesrc=color=pink:amplitude=0.02:duration={AUDIO_SECONDS},lowpass=f=1800"
    result = {}
    for suffix, codec in (("m4a", ["-c:a", "aac", "-b:a", "32k"]), ("mp3", ["-c:a", "libmp3lame", "-b:a", "32k"])):
        target = directory / f"demo.{suffix}"
        command = ["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", source, "-ac", "1", *codec, str(target)]
        try:
            subprocess.run(command, check=True, timeout=120)
        except (OSError, subprocess.SubprocessError) as error:
            raise CommandError(f"ffmpeg is needed to render the demo audio: {error}") from error
        result[suffix] = target.read_bytes()
    return result


def build_transcript(speakers: list[str], rng: random.Random) -> dict:
    segments = []
    position = 1.5
    speaker_index = 0
    while position < AUDIO_SECONDS - 12:
        speaker = speakers[speaker_index % len(speakers)]
        for _ in range(rng.randint(1, 3)):
            text = rng.choice(SENTENCES)
            length = max(3.0, len(text) / 16)
            if position + length > AUDIO_SECONDS - 2:
                break
            segments.append(
                {
                    "start": clock(position),
                    "start_ms": int(position * 1000),
                    "end": clock(position + length),
                    "end_ms": int((position + length) * 1000),
                    "speaker": speaker,
                    "voice": speaker,
                    "text": text,
                }
            )
            position += length + 0.4
        speaker_index += rng.randint(1, 2)
    return {"transcripts": segments}


class Command(BaseCommand):
    help = "Create a synthetic podcast for trying out the React theme. Safe to run again: it replaces its own content."

    def handle(self, *args, **options):
        rng = random.Random(1127)
        site = Site.objects.filter(is_default_site=True).first() or Site.objects.first()
        if site is None:
            raise CommandError("No Wagtail site found. Run `python manage.py migrate` first.")

        user_model = get_user_model()
        owner = user_model.objects.filter(username="mara").first()
        if owner is None:
            owner = user_model.objects.create_superuser("mara", "mara@example.org", "password")

        for existing in Podcast.objects.filter(slug=PODCAST_SLUG):
            existing.delete()

        pictures = [self._image(index, owner) for index in range(8)]
        podcast = Podcast(
            title="Ground Loop",
            slug=PODCAST_SLUG,
            owner=owner,
            subtitle="A podcast about building things for the web and recording them properly.",
            description=(
                "<p>Mara and Tobias talk about software, sound and the open web. "
                "New episodes every other week, with chapters and full transcripts.</p>"
            ),
            author="Mara Lindqvist and Tobias Arendt",
            template_base_dir="react",
            cover_image=pictures[0],
            cover_alt_text="Ground Loop cover",
        )
        root = site.root_page
        root.add_child(instance=podcast)
        if root.title.startswith("Welcome to your new Wagtail site"):
            root.title = "Home"
            root.save()
        TemplateBaseDirectory.objects.update_or_create(site=site, defaults={"name": "react"})

        categories = {}
        for name in ("Audio", "Web", "Backend", "Accessibility"):
            categories[name.lower()], _ = PostCategory.objects.get_or_create(
                slug=name.lower(), defaults={"name": name}
            )

        contributors = {}
        for name in HOSTS + GUESTS:
            slug = name.lower().replace(" ", "-")
            role = "host" if name in HOSTS else "guest"
            contributors[name], _ = Contributor.objects.get_or_create(
                slug=slug, defaults={"display_name": name, "default_role": role}
            )

        with tempfile.TemporaryDirectory() as directory:
            audio_bytes = render_audio(Path(directory))

        now = timezone.now().replace(hour=7, minute=30, second=0, microsecond=0)
        total = len(EPISODES)
        for index, (title, teaser, category, tags) in enumerate(EPISODES):
            number = total - index
            visible_date = now - dt.timedelta(days=3 + index * 16)
            guest = GUESTS[index % len(GUESTS)] if index % 3 != 2 else None
            speakers = HOSTS + ([guest] if guest else [])
            audio = self._audio(owner, title, teaser, audio_bytes, number, rng)
            transcript = Transcript.objects.create(audio=audio)
            transcript.podlove.save(
                "podlove.json", ContentFile(json.dumps(build_transcript(speakers, rng))), save=False
            )
            save_transcript_with_derivations(transcript)

            overview = [
                {"type": "paragraph", "value": f"<p>{teaser}</p>"},
                {"type": "audio", "value": audio.pk},
            ]
            detail = [
                {
                    "type": "paragraph",
                    "value": (
                        "<h2>Show notes</h2>"
                        f"<p>In episode {number} we pick up where the last one ended. {rng.choice(SENTENCES)} "
                        f"{rng.choice(SENTENCES)}</p>"
                        '<ul><li><a href="https://example.org/notes">Our notes for this episode</a></li>'
                        '<li><a href="https://example.org/measurements">The measurements we mention</a></li>'
                        "<li>The text file Mara keeps for moments like this</li></ul>"
                        "<blockquote><p>Start small, write it down, and measure before you change anything.</p>"
                        "</blockquote>"
                    ),
                },
                {
                    "type": "code",
                    "value": {
                        "language": "python",
                        "source": "def loudness(samples):\n    return sum(s * s for s in samples) / len(samples)\n",
                    },
                },
            ]
            episode = Episode(
                title=title,
                slug=f"episode-{number:02d}",
                owner=owner,
                podcast_audio=audio,
                episode_number=number,
                visible_date=visible_date,
                search_description=teaser,
                cover_image=pictures[1 + index % 7],
                cover_alt_text=f"Cover for episode {number}",
                body=json.dumps([{"type": "overview", "value": overview}, {"type": "detail", "value": detail}]),
            )
            podcast.add_child(instance=episode)
            episode.categories.add(categories[category])
            episode.tags.add(*tags)
            for name in speakers:
                EpisodeContributor.objects.create(
                    episode=episode, contributor=contributors[name], role="host" if name in HOSTS else "guest"
                )
            episode.save()
            prepare_post_media(episode)
            if index == 0:
                self._comments(episode, site)

        for index, (title, teaser) in enumerate(POSTS):
            gallery = Gallery.objects.create()
            chosen = pictures[index * 3 : index * 3 + 5]
            gallery.images.add(*chosen)
            items = [{"id": str(uuid4()), "type": "item", "value": image.pk} for image in chosen]
            overview = [
                {"type": "paragraph", "value": f"<p>{teaser}</p>"},
                {"type": "gallery", "value": {"layout": "default", "gallery": items}},
            ]
            detail = [{"type": "paragraph", "value": f"<p>{rng.choice(SENTENCES)} {rng.choice(SENTENCES)}</p>"}]
            post = Post(
                title=title,
                slug=f"notes-{index + 1}",
                owner=owner,
                visible_date=now - dt.timedelta(days=10 + index * 45),
                search_description=teaser,
                body=json.dumps([{"type": "overview", "value": overview}, {"type": "detail", "value": detail}]),
            )
            podcast.add_child(instance=post)
            post.categories.add(categories["web"])
            post.tags.add("behind-the-scenes")
            post.save()
            prepare_post_media(post)

        self.stdout.write(self.style.SUCCESS(f"Seeded {total} episodes and {len(POSTS)} posts at {podcast.url}"))

    def _image(self, index: int, owner) -> Image:
        image = Image(title=f"Demo picture {index + 1}", uploaded_by_user=owner)
        image.file.save(f"demo-{index}.jpg", make_picture(index), save=False)
        image.save()
        return image

    def _audio(self, owner, title: str, teaser: str, audio_bytes: dict[str, bytes], number: int, rng) -> Audio:
        audio = Audio(user=owner, title=title, subtitle=teaser)
        for suffix, content in audio_bytes.items():
            getattr(audio, suffix).save(f"ground-loop-{number:02d}.{suffix}", ContentFile(content), save=False)
        audio.save(duration=True)
        starts = sorted(rng.sample(range(40, AUDIO_SECONDS - 40, 15), len(CHAPTER_TITLES) - 1))
        for start, chapter_title in zip([0, *starts], CHAPTER_TITLES, strict=True):
            ChapterMark.objects.create(audio=audio, start=dt.time(0, start // 60, start % 60), title=chapter_title)
        return audio

    def _comments(self, episode: Episode, site: Site) -> None:
        comment_model = get_comment_model()
        content_type = ContentType.objects.get_for_model(episode)
        parent = None
        for position, (name, text) in enumerate(COMMENTS):
            comment = comment_model.objects.create(
                content_type=content_type,
                object_pk=str(episode.pk),
                site_id=1,
                user_name=name,
                comment=text,
                submit_date=timezone.now() - dt.timedelta(hours=30 - position * 7),
                parent=parent if position == 1 else None,
            )
            if position == 0:
                parent = comment
