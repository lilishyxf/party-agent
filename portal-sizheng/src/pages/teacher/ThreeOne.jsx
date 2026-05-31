import PartyMeetings from './PartyMeetings'

export default function ThreeOne() {
  return <PartyMeetings
    pageTitle="三会一课"
    filterTypes={['party_member_congress', 'branch_committee', 'party_group', 'party_lecture']}
  />
}
