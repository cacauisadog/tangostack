import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("core", "0003_delete_unowned_data"),
    ]

    operations = [
        # NOT NULL without a default: fine because 0003 emptied the table.
        migrations.AddField(
            model_name="todolist",
            name="owner",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="todo_lists",
                to=settings.AUTH_USER_MODEL,
            ),
            preserve_default=False,
        ),
    ]
