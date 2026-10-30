import { describe, expect, it } from 'vitest';
import { zonesToNavItems } from './zones-nav';

const z = (slug: string, name: string, sortOrder: number, facilityName = 'Alpha', icon = 'grid') => ({
  slug,
  name,
  icon,
  sortOrder,
  facilityName,
});

describe('zonesToNavItems', () => {
  it('links each zone to /app/zones/<slug> with its name and icon', () => {
    expect(zonesToNavItems([z('wetaging', 'Wet Aging', 3, 'Alpha', 'snow')])).toEqual([
      { label: 'Wet Aging', href: '/app/zones/wetaging', icon: 'snow' },
    ]);
  });

  it('shows one entry per slug even when several facilities have that zone', () => {
    const items = zonesToNavItems([z('receiving', 'Receiving', 0, 'Alpha'), z('receiving', 'Receiving', 0, 'Beta')]);
    expect(items).toHaveLength(1);
  });

  it('orders by the smallest sortOrder seen for the slug, then by name', () => {
    const items = zonesToNavItems([
      z('shipping', 'Shipping', 5),
      z('receiving', 'Receiving', 0),
      z('coldroom', 'Cold Room', 6),
      z('apples', 'Apples', 6),
      z('shipping', 'Shipping', 1, 'Beta'), // another facility ranks it earlier
    ]);
    expect(items.map((i) => i.href)).toEqual([
      '/app/zones/receiving',
      '/app/zones/shipping',
      '/app/zones/apples',
      '/app/zones/coldroom',
    ]);
  });

  it('returns nothing for no zones', () => {
    expect(zonesToNavItems([])).toEqual([]);
  });
});
