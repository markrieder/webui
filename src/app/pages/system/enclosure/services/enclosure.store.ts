import { computed, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ComponentStore } from '@ngrx/component-store';
import { Subject, switchMap, tap } from 'rxjs';
import { delay, finalize, map } from 'rxjs/operators';
import { EnclosureElementType } from 'app/enums/enclosure-slot-status.enum';
import { Disk } from 'app/interfaces/disk.interface';
import { DashboardEnclosure, DashboardEnclosureSlot } from 'app/interfaces/enclosure.interface';
import { EnclosureView } from 'app/pages/system/enclosure/types/enclosure-view.enum';
import { getEnclosureLabel } from 'app/pages/system/enclosure/utils/get-enclosure-label.utils';
import { EnclosureSide } from 'app/pages/system/enclosure/utils/supported-enclosures';
import { DisksUpdateService } from 'app/services/disks-update.service';
import { ErrorHandlerService } from 'app/services/error-handler.service';
import { WebSocketService } from 'app/services/ws.service';

export interface EnclosureState {
  enclosures: DashboardEnclosure[];
  isLoading: boolean;
  selectedEnclosureIndex: number;
  selectedSlot: DashboardEnclosureSlot;
  selectedView: EnclosureView;
  selectedSide: EnclosureSide;
}

const initialState: EnclosureState = {
  isLoading: true,
  enclosures: [],
  selectedEnclosureIndex: 0,
  selectedSlot: undefined,
  selectedView: EnclosureView.Pools,
  selectedSide: undefined, // Undefined means front or top and will be picked in EnclosureSideComponent.
};

@UntilDestroy()
@Injectable()
export class EnclosureStore extends ComponentStore<EnclosureState> {
  readonly isLoading = toSignal(
    this.state$.pipe(map((state) => state.isLoading)),
    { initialValue: initialState.isLoading },
  );
  readonly selectedSlot = toSignal(
    this.state$.pipe(map((state) => state.selectedSlot)),
    { initialValue: initialState.selectedSlot },
  );
  readonly selectedEnclosure = toSignal(
    this.state$.pipe(map((state) => {
      return state.enclosures[state.selectedEnclosureIndex];
    })),
    { initialValue: undefined },
  );
  readonly selectedEnclosureSlots = computed(() => {
    const slots = this.selectedEnclosure()?.elements?.[EnclosureElementType.ArrayDeviceSlot] || {};
    return Object.values(slots);
  });
  readonly selectedView = toSignal(
    this.state$.pipe(map((state) => state.selectedView)),
    { initialValue: initialState.selectedView },
  );
  readonly selectedSide = toSignal(
    this.state$.pipe(map((state) => state.selectedSide)),
    { initialValue: initialState.selectedSide },
  );

  readonly enclosures = toSignal(
    this.state$.pipe(map((state) => state.enclosures)),
    { initialValue: [] },
  );

  readonly enclosureLabel = computed(() => getEnclosureLabel(this.selectedEnclosure()));

  private disksUpdateSubscriptionId: string;

  constructor(
    private ws: WebSocketService,
    private disksUpdateService: DisksUpdateService,
    private errorHandler: ErrorHandlerService,
  ) {
    super(initialState);
  }

  initiate = this.effect((origin$) => {
    return origin$.pipe(
      tap(() => this.setState(initialState)),
      switchMap(() => {
        return this.ws.call('webui.enclosure.dashboard').pipe(
          tap((enclosures: DashboardEnclosure[]) => {
            this.patchState({ enclosures });
          }),
          this.errorHandler.catchError(),
          delay(100),
          finalize(() => {
            this.patchState({ isLoading: false });
          }),
        );
      }),
    );
  });

  update = this.effect((origin$) => {
    return origin$.pipe(
      switchMap(() => {
        return this.ws.call('webui.enclosure.dashboard').pipe(
          tap((enclosures: DashboardEnclosure[]) => {
            this.patchState({ enclosures });
          }),
          this.errorHandler.catchError(),
        );
      }),
    );
  });

  addListenerForDiskUpdates(): void {
    if (!this.disksUpdateSubscriptionId) {
      const diskUpdatesTrigger$ = new Subject<Disk[]>();
      this.disksUpdateSubscriptionId = this.disksUpdateService.addSubscriber(diskUpdatesTrigger$, true);
      diskUpdatesTrigger$.pipe(untilDestroyed(this)).subscribe(() => this.update());
    }
  }

  removeListenerForDiskUpdates(): void {
    this.disksUpdateService.removeSubscriber(this.disksUpdateSubscriptionId);
  }

  selectEnclosure = this.updater((state, id: string) => {
    const index = state.enclosures.findIndex((enclosure) => enclosure.id === id);

    if (index === state.selectedEnclosureIndex) {
      return state;
    }

    return {
      ...state,
      selectedEnclosureIndex: index,
      selectedSlot: undefined,
      selectedSide: undefined,
      selectedView: EnclosureView.Pools,
    };
  });

  renameSelectedEnclosure = this.updater((state, label: string) => {
    const enclosures = [...state.enclosures];
    enclosures[state.selectedEnclosureIndex] = {
      ...enclosures[state.selectedEnclosureIndex],
      label,
    };

    return {
      ...state,
      enclosures,
    };
  });

  selectSlot = this.updater((state, slot: DashboardEnclosureSlot) => {
    return {
      ...state,
      selectedSlot: slot,
    };
  });

  selectView = this.updater((state, view: EnclosureView) => {
    return {
      ...state,
      selectedView: view,
    };
  });

  selectSide = this.updater((state, side: EnclosureSide) => {
    if (side === state.selectedSide) {
      return state;
    }

    return {
      ...state,
      selectedSide: side,
      selectedSlot: undefined,
    };
  });
}
