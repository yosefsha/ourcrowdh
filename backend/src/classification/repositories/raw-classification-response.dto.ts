import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { Sentiment } from '../mention-classifier.js';

const SENTIMENTS: readonly Sentiment[] = ['positive', 'negative', 'neutral'];

/**
 * The raw shape Ollama returns for `CLASSIFICATION_RESPONSE_SCHEMA`
 * (`../prompt.ts`), before `OllamaMentionClassifier` maps it onto the
 * `Classification` union. Validated with `class-validator` so a reply that
 * drifts from the schema it was given surfaces as a validation error the
 * adapter retries on, never as a raw JSON blob reaching a caller.
 */
export class RawClassificationResponseDto {
  @IsBoolean()
  relevant!: boolean;

  @ValidateIf((dto: RawClassificationResponseDto) => dto.sentiment !== null)
  @IsIn(SENTIMENTS)
  sentiment!: Sentiment | null;

  @IsNumber()
  @Min(0)
  @Max(1)
  confidence!: number;

  @IsString()
  @MaxLength(200)
  rationale!: string;
}
