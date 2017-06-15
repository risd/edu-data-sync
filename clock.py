from apscheduler.schedulers.blocking import BlockingScheduler
import subprocess

sched = BlockingScheduler()

@sched.scheduled_job('interval', minutes=60)
def timed_job():
    subprocess.call(['sync events'])


@sched.scheduled_job('cron', hour=7)
def scheduled_job():
    subprocess.call(['sync employees'])
    subprocess.call(['sync courses'])

sched.start()
