import { themes } from '@trace/design';
import { render, screen } from '@testing-library/react';
import { Text } from 'react-native';
import { afterEach, describe, expect, it } from 'vitest';
import { AuthLayout } from '.';
import { usePreferences } from '../../state/preferences';
import { TestProviders } from '../../test/providers';

afterEach(() => usePreferences.setState(usePreferences.getInitialState()));

const layout = (
  <AuthLayout heading="הזן מספר טלפון" steps={{ labels: ['טלפון', 'אימות'], current: 0 }} footer={<Text>פעולה</Text>}>
    <Text>שדה</Text>
  </AuthLayout>
);

describe('AuthLayout', () => {
  it('names the step with a heading', () => {
    render(layout, { wrapper: TestProviders });
    expect(screen.getByRole('heading', { name: 'הזן מספר טלפון' })).toBeInTheDocument();
  });

  it('shows the brand and the caption', () => {
    render(layout, { wrapper: TestProviders });
    expect(screen.getByText('TRACE Field')).toBeInTheDocument();
    expect(screen.getByText('מחפש שטח')).toBeInTheDocument();
    expect(screen.getByText(/נשמר/)).toBeInTheDocument();
  });

  it.each(['night', 'day'] as const)('paints the surface in %s', (id) => {
    usePreferences.setState({ themePreference: id });
    render(layout, { wrapper: TestProviders });
    expect(screen.getByTestId('auth-layout')).toHaveStyle({ backgroundColor: themes[id].color.surface });
  });

  it('leaves out the stepper when there are no steps', () => {
    render(
      <AuthLayout heading="הזן את שמך" footer={<Text>פעולה</Text>}>
        <Text>שדה</Text>
      </AuthLayout>,
      { wrapper: TestProviders },
    );
    expect(screen.queryByLabelText(/שלב/)).toBeNull();
  });
});
