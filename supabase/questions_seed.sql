-- NOTE:
-- 이 프로젝트는 구(舊) `public.questions`가 아니라
-- `public.question_sets` / `public.sub_questions` 구조를 사용합니다.
--
-- 아래 시드는 "팀 번호 1~10 = 질문 카드 10장"으로 가정해서 재생성합니다.
-- (새 스키마에서는 team_number unique 제약이 없으므로, 시드 실행 시 기존 데이터를 정리하고 다시 넣습니다.)

with seed as (
  select
    v.team_number,
    v.section::text as section,
    v.main_question,
    v.sub_questions
  from (
    values
      (
        1,
        'growth',
        '기획자는 책임만 많이 지는 동네 북 아니야?',
        array[
          '기획자는 그래도 취업 잘 되지 않아?',
          'AI 딸깍 시대에 기획자가 굳이 필요한가?',
          '기획은 아무나 할 수 있는 거 아니야?'
        ]::text[]
      ),
      (
        2,
        'growth',
        '디자이너는 감각 좋으면 끝인 직무 아닌가? / 디자인 솔직히 자기만족 아닌가?',
        array[
          '토스처럼 만들어주세요',
          '요즘 디자이너, 실력보다 브랜딩만 잘하면 되는 거 아니야?'
        ]::text[]
      ),
      (
        3,
        'growth',
        '컴공 졸업해서 프론트엔드 직군은 낭비지',
        array[
          '요즘 프론트엔드는 딸깍이잖아.'
        ]::text[]
      ),
      (
        4,
        'growth',
        '프론트 솔직히 비전공자 누구나 할 수 있는거 아니야?',
        array[]::text[]
      ),
      (
        5,
        'growth',
        '백엔드 개발자, 그냥 Api 상하차 하는 거 아니야?',
        array[]::text[]
      ),
      (
        6,
        'growth',
        '백엔드는 사람 상대 못해서 가는 직무 아니냐?',
        array[
          '백준 알고리즘 푸는 거 의미 없던데?'
        ]::text[]
      ),
      (
        7,
        'connect',
        '오래 사귀는 커플, 이제는 정 때문에 만나는 거 아닌가?',
        array[]::text[]
      ),
      (
        8,
        'connect',
        '썸 오래 타는 거, 그냥 관심 없는 거 아닌가?',
        array[]::text[]
      ),
      (
        9,
        'connect',
        '바쁘다는 이유로 하루동안 연락 안되는 연인, 솔직히 핑계다.',
        array[]::text[]
      ),
      (
        10,
        'connect',
        '화났을 때 바로 말하는 연인 vs 나중에 말하는 애인',
        array[]::text[]
      )
  ) as v(team_number, section, main_question, sub_questions)
),
deleted_sub_questions as (
  delete from public.sub_questions
  returning id
),
deleted_question_selections as (
  delete from public.question_selections
  returning id
),
deleted_question_sets as (
  delete from public.question_sets
  returning id
),
inserted_sets as (
  insert into public.question_sets (team_number, section, main_question, capacity)
  select
    team_number,
    section,
    main_question,
    11
  from seed
  returning id, team_number
),
normalized as (
  select
    s.team_number,
    u.id as question_set_id,
    s.sub_questions
  from seed s
  join inserted_sets u
    on u.team_number = s.team_number
)
insert into public.sub_questions (question_set_id, sort_order, question)
select
  n.question_set_id,
  x.sort_order,
  x.question
from normalized n
cross join lateral unnest(n.sub_questions) with ordinality as x(question, sort_order)
where coalesce(array_length(n.sub_questions, 1), 0) > 0;

