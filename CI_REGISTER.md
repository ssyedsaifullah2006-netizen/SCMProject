# Campus Care Connect — Configuration Item Register

**Project:** Campus Complaint & Maintenance System (CCMS)  
**SCM Tool:** GitHub  
**Repository:** SCMProject

## Configuration Items

| CI ID | Configuration Item | File or Folder | Status |
|---|---|---|---|
| CI-01 | Source Code | `src/` | Identified |
| CI-02 | Public Assets | `public/` | Identified |
| CI-03 | Database/Schema | `drizzle/` and relevant schema files | Verify |
| CI-04 | Dependencies | `package.json` and lock file | Identified |
| CI-05 | Build Configuration | `vite.config.ts`, if present | Verify |
| CI-06 | Project Documentation | `README.md` | Identified |
| CI-07 | SCM Documentation | `CI_REGISTER.md` | In Progress |

## Configuration Control

Project changes are managed using GitHub branches, commits, issues, and pull requests.

## Functional Configuration Audit (FCA)

Verify that implemented functionality meets the documented requirements. Record actual test results.

## Physical Configuration Audit (PCA)

Verify that repository files match the configuration item register and the documented version.

## Baseline and Release

Establish a baseline only after the required audits pass and approval is recorded. Record a release only after authorization.
