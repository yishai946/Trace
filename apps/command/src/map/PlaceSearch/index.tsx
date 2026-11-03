import type { MapProvider } from '@trace/map';
import { Button, ComboBox, Input, Label, ListBox, ListBoxItem, Popover, useAsyncList } from 'react-aria-components';
import { searchPlaces, type Place } from '../geocoding';
import styles from './PlaceSearch.module.css';

interface PlaceSearchProps {
  provider: MapProvider;
  onSelect: (place: Place) => void;
}

/** Search for a place or address in Israel and move the map there. */
export function PlaceSearch({ provider, onSelect }: PlaceSearchProps) {
  const list = useAsyncList<Place>({
    async load({ signal, filterText }) {
      try {
        return { items: await searchPlaces(provider, filterText ?? '', signal) };
      } catch (error) {
        if (signal.aborted) return { items: [] };
        throw error;
      }
    },
  });

  return (
    <ComboBox
      className={styles.root}
      items={list.items}
      inputValue={list.filterText}
      onInputChange={list.setFilterText}
      allowsEmptyCollection
      menuTrigger="input"
      onSelectionChange={(key) => {
        const place = list.items.find((p) => p.id === key);
        if (place) onSelect(place);
      }}
    >
      <Label className={styles.label}>חיפוש מקום</Label>
      <div className={styles.field}>
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className={styles.icon}
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-4-4" />
        </svg>
        <Input className={styles.input} placeholder="חפש מקום, כתובת או נחל…" />
        {list.filterText && (
          // slot={null}: a plain button, not the ComboBox's own trigger that opens the list.
          <Button slot={null} className={styles.clear} aria-label="נקה חיפוש" onPress={() => list.setFilterText('')}>
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </Button>
        )}
      </div>
      <Popover className={styles.popover} placement="bottom start">
        <ListBox<Place>
          className={styles.list}
          renderEmptyState={() => (
            <div className={styles.empty}>
              {list.loadingState === 'loading' || list.loadingState === 'filtering' ? 'מחפש…' : 'לא נמצאו מקומות'}
            </div>
          )}
        >
          {(place) => (
            <ListBoxItem id={place.id} textValue={place.name} className={styles.item}>
              <span className={styles.name}>{place.name}</span>
              <span className={styles.description}>{place.description}</span>
            </ListBoxItem>
          )}
        </ListBox>
      </Popover>
    </ComboBox>
  );
}
