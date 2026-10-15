import { CardElevated } from '@components/card/card-elevated.component';
import { StartContent } from '@components/start/start-content.component';
import { CenterDiv } from '@layouts/center-div.component';
import { EntryLayout } from '@layouts/entry-layout.component';
import Main from '@layouts/main/main.component';

export default function Index() {
  return (
    <EntryLayout>
      <div className="w-full max-w-[64rem]">
        <CardElevated>
          <Main>
            <CenterDiv className="py-24 px-8">
              <StartContent />
            </CenterDiv>
          </Main>
        </CardElevated>
      </div>
    </EntryLayout>
  );
}
