from django.apps import AppConfig


class CoreConfig(AppConfig):
    name = "tangostack.apps.core"

    def ready(self):
        from tangostack import telemetry

        telemetry.setup()
