import { IsUUID } from 'class-validator';

export class AnalyzeRepoDto {
  @IsUUID()
  repository_id: string;
}