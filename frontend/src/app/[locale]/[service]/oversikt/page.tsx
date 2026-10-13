'use client';

import { ErrandFilter } from '@components/errand-filter/errand-filter.component';
import { ErrandTable } from '@components/errand-table/errand-table.component';
import { MobileOverviewLayout } from '@components/mobile/mobile-overview-layout.component';
import { useIsOverviewMobile } from '@contexts/overview-mobile-context';
import { CenterDiv } from '@layouts/center-div.component';
import FilteringLayout from '@layouts/filtering-layout/filtering-layout.component';
import Main from '@layouts/main/main.component';

export default function Oversikt() {
  const isMobile = useIsOverviewMobile();

  if (isMobile) {
    return <MobileOverviewLayout />;
  }

  return (
    <>
      <FilteringLayout>
        <CenterDiv>
          <ErrandFilter />
        </CenterDiv>
      </FilteringLayout>
      <Main>
        <CenterDiv>
          <div className="w-full max-w-screen-desktop-max">
            <ErrandTable />
          </div>
        </CenterDiv>
      </Main>
    </>
  );
}
