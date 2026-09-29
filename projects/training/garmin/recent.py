#!/usr/bin/env python3
"""GARMIN — the last few weeks at a glance, for whoever is reading the export.

    python3 projects/training/garmin/recent.py garmin.json [--days 14]

Prints one line a day (sleep, sleep score, HRV against its weekly average,
resting heart rate, Body Battery, stress, readiness, training status) and the
activities under it. Every field is optional: Garmin only reports what the
watch measured, and a missing value prints as a dash rather than a zero.
"""

import argparse
import datetime as dt
import json
import sys


def dig(o, *path):
    for p in path:
        if isinstance(o, dict):
            o = o.get(p)
        elif isinstance(o, list) and isinstance(p, int) and -len(o) <= p < len(o):
            o = o[p]
        else:
            return None
    return o


def first_device(o):
    """Training status is keyed by device id; there is one watch."""
    if isinstance(o, dict) and o:
        return next(iter(o.values()))
    return None


def f(v, fmt="{}", dash="–"):
    return dash if v is None else fmt.format(v)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("file")
    ap.add_argument("--days", type=int, default=14)
    a = ap.parse_args()
    data = json.load(sys.stdin if a.file == "-" else open(a.file))

    days = data.get("days", {})
    last = max(days) if days else dt.date.today().isoformat()
    since = (dt.date.fromisoformat(last) - dt.timedelta(days=a.days - 1)).isoformat()
    acts = {}
    for x in data.get("activities", []):
        d = str(x.get("startTimeLocal", ""))[:10]
        if d >= since:
            acts.setdefault(d, []).append(x)

    print(f"export generated {data.get('generated', '?')}\n")
    print("date        sleep  score  hrv(wk)   rhr  bb hi/lo  stress  ready       status")
    for d in sorted(k for k in set(days) | set(acts) if k >= since):
        v = days.get(d, {})
        secs = dig(v, "sleep", "dailySleepDTO", "sleepTimeSeconds")
        st = first_device(dig(v, "status", "mostRecentTrainingStatus", "latestTrainingStatusData")) or {}
        ready = dig(v, "readiness", -1) or {}
        print(f"{d}  {f(secs and secs / 3600, '{:4.1f}h'):>6}"
              f"  {f(dig(v, 'sleep', 'dailySleepDTO', 'sleepScores', 'overall', 'value')):>5}"
              f"  {f(dig(v, 'hrv', 'hrvSummary', 'lastNightAvg')):>3}({f(dig(v, 'hrv', 'hrvSummary', 'weeklyAvg'))})"
              f"  {f(dig(v, 'summary', 'restingHeartRate')):>5}"
              f"  {f(dig(v, 'summary', 'bodyBatteryHighestValue')):>4}/{f(dig(v, 'summary', 'bodyBatteryLowestValue')):<3}"
              f"  {f(dig(v, 'summary', 'averageStressLevel')):>6}"
              f"  {f(ready.get('score')):>3} {f(ready.get('level'), dash=''):<8}"
              f"  {f(st.get('trainingStatusFeedbackPhrase') or st.get('trainingStatus'), dash='')}"
              f"{f(dig(st, 'acuteTrainingLoadDTO', 'acwrPercent'), ' · load ratio {}%', dash='')}")
        for x in acts.get(d, []):
            km = x.get("distance")
            mins = x.get("duration")
            print(f"            ↳ {dig(x, 'activityType', 'typeKey') or '?'}"
                  f"  {f(km and km / 1609.344, '{:.1f} mi')}  {f(mins and mins / 60, '{:.0f} min')}"
                  f"  avg hr {f(x.get('averageHR'), '{:.0f}')}  load {f(x.get('activityTrainingLoad'), '{:.0f}')}"
                  f"  ({x.get('activityName', '')})")


if __name__ == "__main__":
    main()
