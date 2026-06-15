# Security Specification - Mavxon IMS

## 1. Data Invariants
- **Identity Integrity**: Every `createdBy` or `userId` field must match `request.auth.uid`.
- **Relational Integrity**: Sales must reference valid inventory types.
- **Role Tiering**: 
  - `supreme_admin`: Full access, user management.
  - `super_admin`/`admin`: Inventory management, sales.
  - `user`: Read inventory, search. Must be `approved`.
- **Immutability**: `createdAt` and `invoiceNumber` (for sales) cannot change after creation.
- **State Locking**: Users start as `pending`. Role escalation must be handled by `supreme_admin`.

## 2. The "Dirty Dozen" Payloads (Deny Cases)

| # | Collection | Action | Payload Description | Security Failure |
|---|------------|--------|----------------------|------------------|
| 1 | /tiles | create | `{ "name": "Fake", "brand": "Fake" }` | Unauthenticated user write |
| 2 | /users | update | `{ "role": "supreme_admin" }` | Non-admin escalates their own role |
| 3 | /users | get | (any) | Guest user reading other user profile |
| 4 | /tiles | update | `{ "diaBariSft": -100 }` | Setting negative inventory stock |
| 5 | /sales | create | `{ "totalAmount": 1000 }` (missing items) | Missing required fields / Schema mismatch |
| 6 | /tiles | create | `{ "name": "Tile", "createdAt": "2099-01-01" }` | Future-dated `createdAt` |
| 7 | /bookedItems| create | `{ "clientName": "..." }` (as guest) | Unapproved user booking items |
| 8 | /settings | update | `{ "header": { ... } }` (as standard user) | Standard user modifying global config |
| 9 | /sales | update | `{ "invoiceNumber": "NEW-ID" }` | Modifying immutable invoice number |
| 10| /tiles | delete | (any) | Non-admin deleting inventory items |
| 11| /users | create | `{ "email": "evil@evil.com", "role": "supreme_admin" }` | Self-assigned supreme role on registration |
| 12| /goods | create | `{ "huge": "X".repeat(1024*1024) }` | Resource poisoning (Value size violation) |

## 3. Test Runner Invariants
The `firestore.rules.test.ts` will verify:
- `supreme_admin` (email: bijoymahmudmunna@gmail.com) has full access.
- `pending` user cannot read inventory.
- `approved` user can read but not write.
- `admin` can modify tiles but not other users' roles.
