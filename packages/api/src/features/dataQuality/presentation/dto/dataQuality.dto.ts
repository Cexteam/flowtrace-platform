/**
 * DTOs for data quality management
 *
 */

import { ApiProperty } from '@nestjs/swagger';

/**
 * Time range for gap checking
 */
export class GapCheckRangeDto {
  @ApiProperty({ description: 'Start of checked range (timestamp)' })
  from!: number;

  @ApiProperty({ description: 'End of checked range (timestamp)' })
  to!: number;

  @ApiProperty({ description: 'Duration of checked range in milliseconds' })
  durationMs!: number;
}

/**
 * Data gap information
 */
export class DataGapDto {
  @ApiProperty({ description: 'Start of gap (timestamp)' })
  from!: number;

  @ApiProperty({ description: 'End of gap (timestamp)' })
  to!: number;

  @ApiProperty({ description: 'Duration of gap in milliseconds' })
  durationMs!: number;
}

/**
 * Gap check response DTO
 */
export class GapCheckResponseDto {
  @ApiProperty({ type: [DataGapDto], description: 'List of detected gaps' })
  gaps!: DataGapDto[];

  @ApiProperty({ description: 'Total number of gaps found' })
  totalGaps!: number;

  @ApiProperty({ description: 'Total missing duration in milliseconds' })
  totalMissingDuration!: number;

  @ApiProperty({ description: 'Data completeness percentage (0-100)' })
  dataCompleteness!: number;

  @ApiProperty({ description: 'The time range that was checked' })
  checkedRange!: GapCheckRangeDto;
}
