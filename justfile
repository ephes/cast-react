# Justfile for cast-react development

default:
    @just --list

# Install Python and JavaScript dependencies
install:
    uv sync
    npm install --ignore-scripts

# Run the Vite development server (use with CAST_REACT_VITE_DEV_MODE=1 for the example site)
js-dev:
    npx vite

# Build the production bundle into cast_react/static/cast_react/
js-build:
    npx vite build

# Check the TypeScript types
js-typecheck:
    npx tsc --noEmit

# Run the JavaScript tests once
js-test:
    npx vitest run

# Run the JavaScript tests in watch mode
js-test-watch:
    npx vitest

# Lint the Python code
lint:
    uv run ruff check .
    uv run ruff format --check .

# Run the Python tests
test:
    uv run pytest

# All checks: lint, types, JavaScript and Python tests
check: lint js-typecheck js-test test

# Create the example database and fill it with a synthetic podcast (needs ffmpeg)
example-seed:
    uv run python manage.py migrate
    uv run python manage.py seed_demo

# Run the example site at http://localhost:8000/ground-loop/
example-run:
    uv run python manage.py runserver
