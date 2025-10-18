import { Test, TestingModule } from '@nestjs/testing';
import { VttGateway } from './vtt.gateway';
import { VttService } from './vtt.service';

describe('VttGateway', () => {
  let gateway: VttGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [VttGateway, VttService],
    }).compile();

    gateway = module.get<VttGateway>(VttGateway);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });
});
