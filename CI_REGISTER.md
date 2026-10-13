# Campus Care Connect — Configuration Item Register

**Project:** Campus Complaint & Maintenance System (CCMS)  
**SCM Tool:** GitHub  
**Repository:** SCMProject

## Configuration Items

| CI ID | Configuration Item | File or Folder | Status |
|---|---|---|---|
| CI-01 | Source Code | `src/` | Identified |
| CI-02 | Public Assets | `public/` | Identified |
| CI-03 | Database/Schema Files | `drizzle/` and relevant schema files | Verify |
| CI-04 | Project Dependencies | `package.json` and lock file | Identified |
| CI-05 | Build Configuration | `vite.config.ts`, if present | Verify |
| CI-06 | Test Configuration | `vitest.config.ts`, if present | Verify |
| CI-07 | Project Documentation | `README.md` | Identified |
| CI-08 | SCM Documentation | `CI_REGISTER.md` | In Progress |

## Configuration Control

Changes to project files are tracked using GitHub branches, commits, Issues, and pull requests.

## Functional Configuration Audit (FCA)

Verify that the actual CCMS functions satisfy their documented requirements. Record test results and supporting evidence.

## Physical Configuration Audit (PCA)

Verify that the repository files match the configuration item register and the documented project version.

## Baseline and Release

Establish a baseline only after the required audits pass and approval is recorded. Record the release version only after authorization.
