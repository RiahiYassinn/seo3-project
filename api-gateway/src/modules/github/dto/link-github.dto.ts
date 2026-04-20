import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LinkGitHubDto {
  @ApiProperty({ example: 'octocat', description: 'GitHub username' })
  @IsString()
  @IsNotEmpty()
  github_username: string;

  @ApiProperty({ example: 'ghp_xxxxxxxxxxxxxxxxxxxx', description: 'GitHub Personal Access Token' })
  @IsString()
  @IsNotEmpty()
  github_token: string;
}
