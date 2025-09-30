import { Test, TestingModule } from '@nestjs/testing';
import { NpcController } from './npc.controller';
import { NpcService } from './npc.service';

describe('NpcController', () => {
  let controller: NpcController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NpcController],
      providers: [NpcService],
    }).compile();

    controller = module.get<NpcController>(NpcController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
