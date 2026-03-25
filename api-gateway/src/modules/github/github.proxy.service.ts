import { Injectable, HttpException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosRequestConfig } from 'axios';

@Injectable()
export class GithubProxyService {
  constructor(private readonly http: HttpService) {}

  async forward<T>(
    method: 'get' | 'post' | 'delete',
    path: string,
    developerId: string,
    body?: any,
  ): Promise<T> {
    const config: AxiosRequestConfig = {
      headers: { 'x-developer-id': developerId },
    };

    try {
      const obs =
        method === 'get'
          ? this.http.get<T>(`/github/${path}`, config)
          : method === 'delete'
          ? this.http.delete<T>(`/github/${path}`, config)
          : this.http.post<T>(`/github/${path}`, body, config);

      const { data } = await firstValueFrom(obs);
      return data;
    } catch (err: any) {
      const status = err?.response?.status ?? 500;
      const message = err?.response?.data?.message ?? err.message ?? 'Developer service error';
      throw new HttpException({ message }, status);
    }
  }
}