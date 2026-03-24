import { IsString, IsNotEmpty, IsUUID } from 'class-validator';

export class SyncReposDto {
  @IsUUID()
  integrationId: string;

  @IsString()
  @IsNotEmpty()
  username: string;
}