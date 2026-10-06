import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Persistence mapping for the `companies` table (`docs/PLAN.md#data-model-initial-migration`).
 * A mutable ORM row, not the immutable `TrackedCompany` the `CompanyRepository`
 * port returns — the implementation maps between the two.
 */
@Entity({ name: 'companies' })
export class CompanyEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text', unique: true })
  slug!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ name: 'former_names', type: 'text', array: true, default: '{}' })
  formerNames!: string[];

  @Column({ name: 'disambiguator', type: 'text', nullable: true })
  disambiguator!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
