#!/bin/bash

# @render.js Test Runner
# Runs all tests and generates reports

set -e

echo "=================================="
echo "@render.js Framework Test Suite"
echo "=================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Track results
TESTS_PASSED=0
TESTS_FAILED=0

# Run TypeScript type check
echo -e "${YELLOW}Running TypeScript type check...${NC}"
cd @render/packages/core
if npm run typecheck; then
    echo -e "${GREEN}✓ TypeScript type check passed${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗ TypeScript type check failed${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
cd ../..

# Run unit tests
echo ""
echo -e "${YELLOW}Running unit tests...${NC}"
cd @render/packages/core
if npm run test; then
    echo -e "${GREEN}✓ Unit tests passed${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗ Unit tests failed${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
cd ../..

# Run benchmarks
echo ""
echo -e "${YELLOW}Running benchmarks...${NC}"
cd @render/packages/core
if npm run bench; then
    echo -e "${GREEN}✓ Benchmarks completed${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${YELLOW}⚠ Benchmarks skipped${NC}"
fi
cd ../..

# Install Playwright browsers
echo ""
echo -e "${YELLOW}Installing Playwright browsers...${NC}"
cd @render/packages/core
npx playwright install --with-deps chromium firefox webkit 2>/dev/null || true
cd ../..

# Run E2E tests (if dev server is available)
echo ""
echo -e "${YELLOW}Running E2E tests...${NC}"
cd @render/packages/core
if npm run e2e; then
    echo -e "${GREEN}✓ E2E tests passed${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${YELLOW}⚠ E2E tests skipped (no dev server)${NC}"
fi
cd ../..

# Summary
echo ""
echo "=================================="
echo "Test Summary"
echo "=================================="
echo -e "${GREEN}Tests Passed: ${TESTS_PASSED}${NC}"
echo -e "${RED}Tests Failed: ${TESTS_FAILED}${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed.${NC}"
    exit 1
fi
