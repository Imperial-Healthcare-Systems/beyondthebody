/* Schema barrel.
 *
 * A module missing from this list is invisible to drizzle-kit, which then reports
 * "no schema changes" and generates nothing — silently, since an unexported table is
 * not an error to it. Add the export in the same commit as the module. */

export * from "./platform";
export * from "./newsletter";
export * from "./catalogue";
export * from "./journal";
export * from "./commerce";
export * from "./payments";
