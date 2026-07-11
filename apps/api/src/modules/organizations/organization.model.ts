import { Schema, model, type Types } from 'mongoose';

export interface OrganizationDoc {
  _id: Types.ObjectId;
  name: string;
  ownerUserId: Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const organizationSchema = new Schema<OrganizationDoc>(
  {
    name: { type: String, required: true, trim: true },
    ownerUserId: { type: Schema.Types.ObjectId, required: true },
    isActive: { type: Boolean, default: true },
  },
  { collection: 'organizations', timestamps: true },
);

export const OrganizationModel = model<OrganizationDoc>('Organization', organizationSchema);
