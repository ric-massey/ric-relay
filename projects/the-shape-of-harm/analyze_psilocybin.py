#!/usr/bin/env python3
"""Reproduce the v0.4 direct-stratum rare-event intervals.
Requires scipy and statsmodels. This script intentionally does not pool outcomes
whose windows or units are incompatible.
"""
from statsmodels.stats.proportion import proportion_confint, confint_proportions_2indep

def exact(x,n):
    lo,hi=proportion_confint(x,n,alpha=0.05,method="beta")
    return lo*1000,hi*1000

active=(0,67)
control=(0,72)
print("Drug-related SAE, direct MDD stratum")
for label,(x,n) in [("psilocybin",active),("niacin",control)]:
    lo,hi=exact(x,n)
    print(f"{label}: {x}/{n}; {x/n*1000:.1f} per 1000 (95% exact CI {lo:.1f} to {hi:.1f})")
lo,hi=confint_proportions_2indep(*active,*control,method="newcomb",compare="diff",alpha=0.05)
print(f"Risk difference: 0.0 per 1000 (95% Newcombe CI {lo*1000:.1f} to {hi*1000:.1f})")
print("Not pooled: severe psychiatric events, rescue medication, all-cause SAE; reporting windows/units are incompatible.")
