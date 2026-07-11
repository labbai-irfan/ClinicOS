import type { Types } from 'mongoose';
import type { Permission, RoleKey } from '@clinicos/types';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      auth?: {
        userId: Types.ObjectId;
        sessionId: Types.ObjectId;
        email: string;
        name: string;
      };
      tenant?: {
        organizationId: Types.ObjectId;
        clinicId: Types.ObjectId;
        branchId: Types.ObjectId;
        branchIds: Types.ObjectId[];
        membershipId: Types.ObjectId;
        roleKey: RoleKey;
        permissions: ReadonlySet<Permission>;
        timezone: string;
      };
    }
  }
}

export {};
