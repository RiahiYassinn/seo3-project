import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { DeveloperService } from './developer.service';

@Controller('developers')
export class DeveloperController {
  constructor(private readonly developerService: DeveloperService) {}

  // HTTP endpoints
  @Get()
  findAll() {
    return this.developerService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.developerService.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updateDto: any) {
    return this.developerService.update(id, updateDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.developerService.remove(id);
  }

  // Kafka message handlers
  @MessagePattern('developer.find.all')
  async handleFindAll(@Payload() message: any) {
    return this.developerService.findAll();
  }

  @MessagePattern('developer.find.one')
  async handleFindOne(@Payload() message: any) {
    return this.developerService.findOne(message.id);
  }

  @MessagePattern('developer.update')
  async handleUpdate(@Payload() message: any) {
    return this.developerService.update(message.id, message.data);
  }
}
