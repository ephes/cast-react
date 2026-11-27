// Shapes of the django-cast API responses and of the player payload
// (`cast.player.build_player_payload`) this theme consumes.

export interface Comment {
  id: number;
  parent: number | null;
  user: string;
  date: string;
  comment: string;
}

export interface CommentSecurityData {
  content_type: string;
  object_pk: string;
  timestamp: string | number;
  security_hash: string;
}

export interface Post {
  id: number;
  title: string;
  visible_date?: string;
  html_overview?: string;
  html_detail?: string;
  cover_image_poster_url?: string;
  comments_are_enabled?: boolean;
  comments?: Comment[];
  comments_security_data?: CommentSecurityData;
  meta: {
    type: string;
    detail_url: string;
    html_url: string;
    slug: string;
    first_published_at: string;
  };
}

export interface PostsFromApi {
  meta: { total_count: number };
  items: Post[];
}

export interface Facet {
  slug: string;
  name: string;
  count: number;
}

export interface FacetCounts {
  date_facets?: Facet[];
  category_facets?: Facet[];
  tag_facets?: Facet[];
}

export interface FacetCountsFromApi {
  facet_counts: FacetCounts;
}

export interface Theme {
  slug: string;
  name: string;
  selected: boolean;
}

export interface Chapter {
  start: number;
  title: string;
}

export interface Cue {
  start: number;
  end: number;
  speaker: string;
  text: string;
}

export interface AudioSource {
  type: string;
  src: string;
}

export interface PlayerPayload {
  audioId: number;
  title: string;
  subtitle: string;
  duration: number | null;
  permalink?: string;
  poster: string;
  sources: AudioSource[];
  chapters: Chapter[];
  transcript: { url: string } | null;
}

export interface ArticleMeta {
  date: string;
  dateTime: string;
  author: string;
  transcriptUrl: string;
}

// The filter values kept in the address bar of the post list.
export const FILTER_KEYS = [
  "search",
  "date_after",
  "date_before",
  "date_facets",
  "category_facets",
  "tag_facets",
  "o",
] as const;

export type FilterKey = (typeof FILTER_KEYS)[number];
export type Filters = Partial<Record<FilterKey, string>>;
