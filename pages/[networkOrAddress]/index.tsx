import {
  Alert,
  AlertIcon,
  AlertTitle,
  Center,
  Flex,
  Spinner,
} from "@chakra-ui/react";
import { QueryClient, dehydrate } from "@tanstack/react-query";
import { useAddress } from "@thirdweb-dev/react";
import { ThirdwebSDK } from "@thirdweb-dev/sdk";
import { AppLayout } from "components/app-layouts/app";
import { DeployableContractTable } from "components/contract-components/contract-table";
import {
  ens,
  fetchPublishedContracts,
  fetchReleaserProfile,
  usePublishedContractsQuery,
} from "components/contract-components/hooks";
import { ReleaserHeader } from "components/contract-components/releaser/releaser-header";
import { PublisherSDKContext } from "contexts/custom-sdk-context";
import { useSingleQueryParam } from "hooks/useQueryParam";
import { GetStaticPaths, GetStaticProps } from "next";
import { useRouter } from "next/router";
import { ReactElement, useEffect } from "react";
import { IoRefreshSharp } from "react-icons/io5";
import { Button, LinkButton, Text } from "tw-components";
import { getSingleQueryValue } from "utils/router";

const UserPageWrapped = () => {
  const wallet = useSingleQueryParam("networkOrAddress");

  const ensQuery = ens.useQuery(wallet);

  const address = useAddress();
  const router = useRouter();
  const publishedContracts = usePublishedContractsQuery(
    ensQuery.data?.address || undefined,
  );

  // We do this so it doesn't break for users that haven't updated their CLI
  useEffect(() => {
    const previousPath = router.asPath.split("/")[2];
    if (
      previousPath !== "[networkOrAddress]" &&
      wallet?.startsWith("Qm") &&
      !wallet.endsWith(".eth")
    ) {
      router.replace(`/contracts/deploy/${previousPath}`);
    }
  }, [wallet, router]);

  return (
    <Flex flexDir="column" gap={8}>
      {wallet && <ReleaserHeader wallet={wallet} />}
      <Flex flexDir="column" gap={4}>
        <DeployableContractTable
          isFetching={publishedContracts.isFetching}
          contractIds={(publishedContracts.data || [])?.map((d) =>
            d.metadataUri.replace("ipfs://", ""),
          )}
          context="view_release"
        >
          {publishedContracts.isLoading && (
            <Center>
              <Flex py={4} direction="row" gap={4} align="center">
                {wallet && <Spinner size="sm" />}
                <Text>
                  {wallet ? "Loading releases" : "No wallet connected"}
                </Text>
              </Flex>
            </Center>
          )}
          {publishedContracts.isError && (
            <Center>
              <Flex mt={4} py={4} direction="column" gap={4} align="center">
                <Alert status="error" borderRadius="md">
                  <AlertIcon />
                  <AlertTitle mr={2}>
                    Failed to fetch released contracts
                  </AlertTitle>
                  <Button
                    onClick={() => publishedContracts.refetch()}
                    leftIcon={<IoRefreshSharp />}
                    ml="auto"
                    size="sm"
                    colorScheme="red"
                  >
                    Retry
                  </Button>
                </Alert>
              </Flex>
            </Center>
          )}
          {publishedContracts.isSuccess &&
            publishedContracts.data.length === 0 && (
              <Center>
                <Flex py={4} direction="column" gap={4} align="center">
                  <Text>No releases found.</Text>
                  {ensQuery.data?.address === address && (
                    <LinkButton
                      size="sm"
                      href="https://portal.thirdweb.com/release"
                      isExternal
                      variant="outline"
                      colorScheme="primary"
                    >
                      Learn more about releasing contracts
                    </LinkButton>
                  )}
                </Flex>
              </Center>
            )}
        </DeployableContractTable>
      </Flex>
    </Flex>
  );
};

export default function UserPage() {
  return (
    <PublisherSDKContext>
      <UserPageWrapped />
    </PublisherSDKContext>
  );
}

UserPage.getLayout = function getLayout(page: ReactElement) {
  return <AppLayout>{page}</AppLayout>;
};

export const getStaticProps: GetStaticProps = async (ctx) => {
  const queryClient = new QueryClient();
  // TODO make this use alchemy / other RPC
  // currently blocked because our alchemy RPC does not allow us to call this from the server (since we have an allow-list)
  const sdk = new ThirdwebSDK("polygon");

  const walletOrEnsAddress = getSingleQueryValue(
    ctx.params,
    "networkOrAddress",
  );

  if (!walletOrEnsAddress) {
    return {
      redirect: {
        destination: "/contracts",
        permanent: false,
      },
      props: {},
    };
  }

  const ensQuery = await queryClient.fetchQuery(
    ens.queryKey(walletOrEnsAddress),
    () => ens.fetch(walletOrEnsAddress),
  );

  if (!ensQuery.address) {
    return {
      redirect: {
        destination: "/contracts",
        permanent: false,
      },
      props: {},
    };
  }
  await Promise.all([
    queryClient.prefetchQuery(["releaser-profile", ensQuery.address], () =>
      fetchReleaserProfile(sdk, ensQuery.address),
    ),
    queryClient.prefetchQuery(["published-contracts", ensQuery.address], () =>
      fetchPublishedContracts(sdk, ensQuery.address),
    ),
  ]);

  return {
    props: {
      dehydratedState: dehydrate(queryClient),
    },
  };
};

export const getStaticPaths: GetStaticPaths = async () => {
  return {
    fallback: "blocking",
    paths: [],
  };
};