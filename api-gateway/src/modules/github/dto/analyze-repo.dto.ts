import { IsString, IsNotEmpty, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AnalyzeRepositoryDto  {
  @ApiProperty({ description: 'Repository ID' })
  @IsUUID()
  @IsNotEmpty()
  repository_id: string;
}
