import React from 'react';
import { render } from '@testing-library/react';

jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { redirect } = require('next/navigation');

import Page from '../src/app/(app)/page';

describe('Page', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<Page />);
    expect(baseElement).toBeTruthy();
  });

  it('should redirect to /sprites', () => {
    render(<Page />);
    expect(redirect).toHaveBeenCalledWith('/sprites');
  });
});
