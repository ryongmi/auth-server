import { CreateDateColumn, UpdateDateColumn, DeleteDateColumn } from "typeorm";

export abstract class TimestampEntity {
  @CreateDateColumn({ type: "timestamp" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamp" })
  updatedAt!: Date;

  @DeleteDateColumn({ type: "timestamp" })
  deletedAt?: Date | null;
}
