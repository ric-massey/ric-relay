"""A stand-in for the garminconnect library, for test.mjs. Serves a watch that
was bought on FIRST_DAY, carries coordinates and time series in every payload
(so the test can prove they are dropped), and can be told to rate-limit."""
import datetime as dt
import os


class GarminConnectAuthenticationError(Exception):
    pass


class GarminConnectTooManyRequestsError(Exception):
    pass


FIRST_DAY = dt.date.today() - dt.timedelta(days=int(os.environ.get("FAKE_HISTORY_DAYS", "90")))
CALLS = {"n": 0}


class Garmin:
    def __init__(self, email=None, password=None, prompt_mfa=None, **_):
        self.email = email

    def login(self, tokenstore=None):
        if self.email != "ric@example.com":
            raise GarminConnectAuthenticationError("bad login")
        return None, None

    def _tick(self):
        CALLS["n"] += 1
        limit = int(os.environ.get("FAKE_RATE_LIMIT_AFTER", "0"))
        if limit and CALLS["n"] > limit:
            raise GarminConnectTooManyRequestsError("429")

    def _worn(self, d):
        return dt.date.fromisoformat(d) >= FIRST_DAY

    def get_user_summary(self, d):
        self._tick()
        if not self._worn(d):
            return {"totalSteps": None, "restingHeartRate": None}
        return {"calendarDate": d, "totalSteps": 9000, "restingHeartRate": 48,
                "bodyBatteryHighestValue": 88, "averageStressLevel": 27,
                "userProfileId": 12345, "displayName": "ric-secret-name"}

    def get_sleep_data(self, d):
        self._tick()
        if not self._worn(d):
            return {}
        return {"dailySleepDTO": {"sleepTimeSeconds": 26000,
                                  "sleepScores": {"overall": {"value": 74, "qualifierKey": "FAIR"}}},
                "sleepMovement": [{"startGMT": "x", "activityLevel": i} for i in range(400)],
                "sleepHeartRate": [[i, 50] for i in range(300)],
                "avgOvernightHrv": 61}

    def get_hrv_data(self, d):
        self._tick()
        if not self._worn(d):
            raise Exception("404 no hrv")
        return {"hrvSummary": {"lastNightAvg": 61, "weeklyAvg": 64, "status": "BALANCED"},
                "hrvReadings": [{"hrvValue": 60 + i} for i in range(80)]}

    def get_training_readiness(self, d):
        self._tick()
        if not self._worn(d):
            return []
        return [{"timestamp": d + "T07:00", "score": 40, "level": "LOW"},
                {"timestamp": d + "T12:00", "score": 55, "level": "MODERATE"}]

    def get_training_status(self, d):
        self._tick()
        return {"mostRecentTrainingStatus": {"latestTrainingStatusData": {"3456": {
            "trainingStatus": 4, "acuteTrainingLoadDTO": {"acwrPercent": 130}}}}} if self._worn(d) else None

    def get_activities(self, start, limit):
        self._tick()
        acts = [{"activityId": 1000 + i, "activityName": "Knoxville Run",
                 "startTimeLocal": (FIRST_DAY + dt.timedelta(days=i)).isoformat() + " 07:00:00",
                 "activityType": {"typeKey": "running", "typeId": 1},
                 "distance": 8000.0, "averageHR": 150, "hrTimeInZone_2": 1200.5,
                 "startLatitude": 35.96, "startLongitude": -83.92, "endLatitude": 35.97,
                 "locationName": "Knoxville", "ownerFullName": "Ric M",
                 "ownerProfileImageUrlLarge": "https://x"}
                for i in range(0, 90, 2)]
        return acts[start:start + limit]

    def get_personal_record(self):
        self._tick()
        return [{"typeId": 3, "value": 1500.0}]

    def get_race_predictions(self):
        self._tick()
        return {"time5K": 1320, "timeMarathon": 12600}
