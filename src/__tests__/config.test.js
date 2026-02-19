import { NAV_LINKS, SECTIONS } from '../config';

describe('ESG Platform config', () => {
  it('defines all three nav links', () => {
    expect(NAV_LINKS).toEqual(['Dashboard', 'Compliance', 'Simulator']);
  });

  it('defines section content for each nav target', () => {
    const sectionIds = NAV_LINKS.map((link) => link.toLowerCase());
    sectionIds.forEach((id) => {
      expect(SECTIONS[id]).toBeDefined();
      expect(typeof SECTIONS[id]).toBe('string');
      expect(SECTIONS[id].length).toBeGreaterThan(0);
    });
  });

  it('has matching section ids for nav links', () => {
    const sectionIds = Object.keys(SECTIONS);
    const expectedIds = NAV_LINKS.map((link) => link.toLowerCase());
    expect(sectionIds.sort()).toEqual(expectedIds.sort());
  });
});
