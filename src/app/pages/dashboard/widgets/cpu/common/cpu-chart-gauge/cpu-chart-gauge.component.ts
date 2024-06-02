import {
  ChangeDetectionStrategy, Component, Signal, computed,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';
import { map } from 'rxjs/operators';
import { GaugeConfig } from 'app/modules/charts/components/view-chart-gauge/view-chart-gauge.component';
import { WidgetResourcesService } from 'app/pages/dashboard/services/widget-resources.service';

@Component({
  selector: 'ix-cpu-chart-gauge',
  templateUrl: './cpu-chart-gauge.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CpuChartGaugeComponent {
  protected cpuData = toSignal(this.resources.realtimeUpdates$.pipe(
    map((update) => update.fields.cpu),
  ));

  protected isLoading = computed(() => !this.cpuData());

  protected cpuAvg: Signal<GaugeConfig> = computed(() => {
    const data = ['Load', parseInt(this.cpuData().average.usage.toFixed(1))];
    return {
      label: false,
      data,
      units: '%',
      diameter: 136,
      fontSize: 28,
      max: 100,
      subtitle: this.translate.instant('Avg Usage'),
    };
  });

  constructor(
    private resources: WidgetResourcesService,
    private translate: TranslateService,
  ) {}
}
