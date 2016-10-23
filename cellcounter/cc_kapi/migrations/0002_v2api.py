# -*- coding: utf-8 -*-
# Generated by Django 1.9.6 on 2016-05-24 16:16
from __future__ import unicode_literals

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion

from ..defaults import BUILTIN_KEYBOARDS

def default_keyboards(apps, schema_editor):
    CellType = apps.get_model("main", "CellType")

    KeyMap = apps.get_model("cc_kapi", "KeyMap")
    Keyboard = apps.get_model("cc_kapi", "Keyboard")

    for keyboard_data in BUILTIN_KEYBOARDS:
        mappings_data = keyboard_data.pop('mappings')
        kb = Keyboard.objects.create(**keyboard_data)

        celltype_objects = [CellType.objects.get(id=mapping['cellid']) for
                            mapping in mappings_data]

        mapping_objects = [KeyMap.objects.get_or_create(cellid=ct, key=mapping['key'])[0] for
                           (mapping, ct) in zip(mappings_data, celltype_objects)]

        [kb.mappings.add(x) for x in mapping_objects]

        kb.save()


class Migration(migrations.Migration):

    dependencies = [
        ('auth', '0007_alter_validators_add_error_messages'),
        ('main', '0002_initial_data'),
        ('cc_kapi', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='DefaultKeyboards',
            fields=[
                ('user', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, primary_key=True, serialize=False, to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.RemoveField(
            model_name='keyboard',
            name='is_primary',
        ),
        migrations.AddField(
            model_name='keyboard',
            name='device_type',
            field=models.PositiveIntegerField(choices=[(1, b'desktop'), (2, b'mobile')], default=1),
        ),
        migrations.AlterField(
            model_name='keyboard',
            name='user',
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL),
        ),
        migrations.AddField(
            model_name='defaultkeyboards',
            name='desktop',
            field=models.ForeignKey(default=None, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='desktop_default', to='cc_kapi.Keyboard'),
        ),
        migrations.AddField(
            model_name='defaultkeyboards',
            name='mobile',
            field=models.ForeignKey(default=None, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='mobile_default', to='cc_kapi.Keyboard'),
        ),
        migrations.AlterField(
            model_name='keyboard',
            name='created',
            field=models.DateTimeField(default=django.utils.timezone.now),
        ),
        migrations.AlterField(
            model_name='keyboard',
            name='last_modified',
            field=models.DateTimeField(default=django.utils.timezone.now),
        ),
        migrations.RunPython(default_keyboards),
    ]
