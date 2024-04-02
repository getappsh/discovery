import { mapEntityStub } from "../stubs/map.stub";

export const mockMapRepo = () => {
  return {
    findOneBy: jest.fn().mockResolvedValue(mapEntityStub()),
  }
};
