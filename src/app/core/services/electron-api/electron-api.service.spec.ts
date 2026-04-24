import { TestBed } from '@angular/core/testing';

import { ElectronApiService } from './electron-api.service';

describe('FileStorageService', () => {
  let service: ElectronApiService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ElectronApiService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
