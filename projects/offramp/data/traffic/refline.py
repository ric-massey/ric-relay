"""The corridor as lat/lon, so anything measured in the real world can
be put on it.

`data/i40.js` ships the road *developed* onto a plane — every curve and
every distance true, global orientation allowed to drift — which is the
right thing for driving on and the wrong thing for joining to. HPMS
sections arrive as lat/lon, and there is no way back from a developed
coordinate to a geographic one.

So this rebuilds the eastbound chain from the same OSM slices
`osm/corridor.py` uses and keeps what that file throws away: the lat/lon
of every waypoint against its distance along the route. `px` is then
`metres / M_PER_PX`, which is the same number the game indexes
everything else by, because it came out of the same walk.

Cached to `refline.json` (about 1 MB) because the chain-and-stitch pass
takes the better part of a minute and nothing about it changes.
"""
import json, math, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
OSM = os.path.join(HERE, '..', 'osm')
sys.path.insert(0, OSM)

CACHE = os.path.join(HERE, 'refline.json')
# v2, not the files beside it: the first fetch required "; " between the
# refs in a concurrency and OSM writes none, which dropped most of
# Nashville and Knoxville. `fetch2.sh` is the corrected one and v2/ is
# what the shipped corridor was built from.
SRC = os.path.join(OSM, 'v2')
SLICES = ['CA_AZ.json', 'AZ_NM.json', 'NM.json', 'TX_OK.json', 'OK_AR.json',
          'AR_TN.json', 'TN_E.json', 'NC.json']
M_PER_PX = 0.179
MI = 1609.34
R_EARTH = 6371008.8


def build():
    from extract import load, chain, stitch, develop
    from corridor import carriageways
    ways, junc = load([os.path.join(SRC, s) for s in SLICES])
    devs = sorted((develop(c, junc) for c in stitch(chain(ways), junc)),
                  key=lambda d: -d['cum'][-1])
    east, _ = carriageways(devs)
    if not east:
        sys.exit('no eastbound chain')
    d = east[0]
    return {'lat': [round(p['lat'], 6) for p in d['pts']],
            'lon': [round(p['lon'], 6) for p in d['pts']],
            'm': [round(v, 1) for v in d['cum']]}


def load_ref():
    if not os.path.exists(CACHE):
        print('building reference line from OSM (once)...')
        json.dump(build(), open(CACHE, 'w'), separators=(',', ':'))
    return json.load(open(CACHE))


class Ref:
    """Nearest point on the corridor, by lat/lon.

    A hundredth of a degree is about 1.1 km north-south and 0.9 km
    east-west at these latitudes, so a 3x3 block of those cells always
    contains anything within the 1.5 km the join is willing to accept.
    Without the grid this is 40,000 sections against 27,000 waypoints.
    """
    CELL = 0.01

    def __init__(self, ref):
        self.lat, self.lon, self.m = ref['lat'], ref['lon'], ref['m']
        self.grid = {}
        for i, (la, lo) in enumerate(zip(self.lat, self.lon)):
            self.grid.setdefault((round(la / self.CELL), round(lo / self.CELL)),
                                 []).append(i)

    def near(self, la, lo):
        """(metres along the corridor, metres away from it) or (None, None)"""
        ci, cj = round(la / self.CELL), round(lo / self.CELL)
        best, bi = 1e18, -1
        for a in (-1, 0, 1):
            for b in (-1, 0, 1):
                for i in self.grid.get((ci + a, cj + b), ()):
                    d = _hav(la, lo, self.lat[i], self.lon[i])
                    if d < best:
                        best, bi = d, i
        if bi < 0:
            return None, None
        return self.m[bi], best


def _hav(la1, lo1, la2, lo2):
    p1, p2 = math.radians(la1), math.radians(la2)
    dl = math.radians(lo2 - lo1)
    dp = p2 - p1
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R_EARTH * math.asin(min(1, math.sqrt(h)))


if __name__ == '__main__':
    r = load_ref()
    print(f"{len(r['m'])} points, {r['m'][-1]/MI:.2f} mi, "
          f"{r['m'][-1]/M_PER_PX/1e6:.2f}M px")
    print(f"  west end {r['lat'][0]}, {r['lon'][0]}")
    print(f"  east end {r['lat'][-1]}, {r['lon'][-1]}")
