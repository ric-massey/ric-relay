#!/usr/bin/env python3
"""Reproduce v0.5 rare-event sensitivity and information-size targets.
Requires scipy. The script does not invent estimates for blocked outcomes.
"""
import math
from scipy.stats import beta

def exact(x,n,alpha=.05):
    lo=0.0 if x==0 else beta.ppf(alpha/2,x,n-x+1)
    hi=1.0 if x==n else beta.ppf(1-alpha/2,x+1,n-x)
    return lo*1000,hi*1000

print("Sensitivity analyses (events per 1,000; two-sided 95% exact CI)")
for label,x,n in [
    ("Primary pooled direct stratum",0,67),
    ("Raison 2023 alone",0,50),
    ("Yngwe 2026 alone",0,17),
    ("One missed/reclassified event",1,67),
    ("Two missed/reclassified events",2,67),
]:
    lo,hi=exact(x,n)
    print(f"{label}: {x}/{n} = {x/n*1000:.1f}; CI {lo:.1f} to {hi:.1f}")

print("\nZero-event information targets")
for threshold in [50,25,10,5,1]:
    p=threshold/1000
    n=math.ceil(math.log(.025)/math.log(1-p))
    print(f"Upper limit < {threshold}/1000: total n={n}; additional beyond 67={max(0,n-67)}")
