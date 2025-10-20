#!/usr/bin/env bash
set -euo pipefail

# Generate TypeScript types from OpenAPI spec
# Usage: ./scripts/generate-sdk-types.sh [output-path]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

OPENAPI_SPEC="$PROJECT_ROOT/docs/api/openapi.yaml"
OUTPUT_PATH="${1:-$PROJECT_ROOT/src/generated/api-types.ts}"

# Check if openapi-typescript is installed
if ! command -v openapi-typescript &> /dev/null; then
  echo "Error: openapi-typescript is not installed"
  echo "Install it with: npm install -D openapi-typescript"
  exit 1
fi

# Check if OpenAPI spec exists
if [[ ! -f "$OPENAPI_SPEC" ]]; then
  echo "Error: OpenAPI spec not found at $OPENAPI_SPEC"
  echo "Generate it first with: pnpm openapi:generate"
  exit 1
fi

echo "Generating TypeScript types from OpenAPI spec..."
echo "Input: $OPENAPI_SPEC"
echo "Output: $OUTPUT_PATH"

# Create output directory if it doesn't exist
mkdir -p "$(dirname "$OUTPUT_PATH")"

# Generate TypeScript types
npx openapi-typescript "$OPENAPI_SPEC" -o "$OUTPUT_PATH"

echo "✓ TypeScript types generated successfully"
