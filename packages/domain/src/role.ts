/**
 * The two kinds of user (spec §3). A commander signs in to Command with email and password; a searcher signs in to
 * Field with a phone number and OTP. In the MVP each mission has one commander, who created it.
 */
export const USER_ROLES = ['commander', 'searcher'] as const;
export type UserRole = (typeof USER_ROLES)[number];
