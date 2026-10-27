from django.db import migrations


def delete_all_lists(apps, schema_editor):
    """Lists used to be global; with owners, the old (dev-only) data has none."""
    apps.get_model("core", "TodoList").objects.all().delete()


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0002_todolist_todo"),
    ]

    operations = [
        # Separate from the schema change: Postgres can't ALTER a table that has
        # pending trigger events from deletes in the same transaction.
        migrations.RunPython(delete_all_lists, migrations.RunPython.noop),
    ]
