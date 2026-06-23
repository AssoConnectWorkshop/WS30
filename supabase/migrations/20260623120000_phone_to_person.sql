create table if not exists phone_to_person (
  phone text primary key,
  person_iri text not null
);

insert into phone_to_person (phone, person_iri)
values ('*', '/api/v1/persons/01KVTGQXSSNSQV5CA3541A3E7X')
on conflict (phone) do nothing;
