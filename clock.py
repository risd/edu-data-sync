from apscheduler.schedulers.blocking import BlockingScheduler
import subprocess

sched = BlockingScheduler()

@sched.scheduled_job('interval', minutes=60)
def timed_job():
	subprocess.call(['syncHourly'])


@sched.scheduled_job('cron', day_of_week='sat', hour=6)
def scheduled_job():
	subprocess.call(['syncWeekly'])

sched.start()