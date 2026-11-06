# Security Specification - Khel Galli

## Data Invariants
1. A transaction cannot be created for another user unless by an admin.
2. Transactions are immutable (no updates or deletes allowed).
3. A user can only see their own registrations and transactions (unless admin).
4. Matches can only be modified by admins, except for player joining (players/playersCount fields).
5. User profiles can only be created by the user themselves.

## The "Dirty Dozen" Payloads (to be rejected)
1. **Malicious Transaction Creation**: Creating a transaction with a different `userId`.
2. **Transaction Modification**: Attempting to update a completed transaction.
3. **Admin Privilege Escalation**: A user trying to set `isAdmin: true` on their own profile.
4. **Illegal Match Deletion**: A non-admin trying to delete a match.
5. **Score Injection**: A user trying to declare match results.
6. **Balance Spoofing**: A user trying to update their own `wallet.deposit`.
7. **Identity Theft**: Creating a registration with someone else's `userId`.
8. **Shadow Field Injection**: Adding `isVerified: true` to a profile update.
9. **Rule Modification**: Unauthorized write to `gameRules`.
10. **Banner Hijacking**: Unauthorized write to `banners`.
11. **Referral Fraud**: Self-rewarding by setting `referredBy` to itself (handled in logic, but rules should protect).
12. **Orphaned Registration**: Creating a registration for a non-existent match (handled by exists() check).

## The Test Runner
Tests will be implemented in `firestore.rules.test.ts` (conceptual).
