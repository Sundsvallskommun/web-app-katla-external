import { ErrandLayoutContent } from '@components/errand-layout/errand-layout-content.component';

export default function ErrandLayout({ children }: { children: React.ReactNode }) {
  return <ErrandLayoutContent>{children}</ErrandLayoutContent>;
}
