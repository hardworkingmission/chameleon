import { convertHeic } from '../src/services/conversion/heic.service';
import { CorruptFileError } from '../src/utils/errors';

describe('HEIC conversion service', () => {
  it('throws a CorruptFileError for invalid HEIC bytes', async () => {
    const bogus = Buffer.from('not a real heic file');
    await expect(convertHeic(bogus, 'jpg')).rejects.toBeInstanceOf(CorruptFileError);
  });
});
