import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Developer } from './entities/developer.entity';

@Injectable()
export class DeveloperService {
  constructor(
    @InjectRepository(Developer)
    private readonly developerRepository: Repository<Developer>,
  ) {}

  async findAll(): Promise<Developer[]> {
    return this.developerRepository.find();
  }

  async findOne(id: string): Promise<Developer> {
    const developer = await this.developerRepository.findOne({ where: { id } });
    if (!developer) {
      throw new NotFoundException(`Developer with ID ${id} not found`);
    }
    return developer;
  }

  async findByEmail(email: string): Promise<Developer> {
    return this.developerRepository.findOne({ where: { email } });
  }

  async create(createDto: Partial<Developer>): Promise<Developer> {
    const developer = this.developerRepository.create(createDto);
    return this.developerRepository.save(developer);
  }

  async update(id: string, updateDto: Partial<Developer>): Promise<Developer> {
    await this.findOne(id);
    await this.developerRepository.update(id, updateDto);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const developer = await this.findOne(id);
    await this.developerRepository.remove(developer);
  }
}
